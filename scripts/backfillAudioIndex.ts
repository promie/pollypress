/**
 * One-off: adds audio converted before duplicate detection existed to the
 * AudioIndex table, so uploading those documents again reuses their MP3.
 *
 *   npm run backfill:audio-index -- --dry-run   # report only
 *   npm run backfill:audio-index                # write to the index
 *
 * Safe to re-run: entries are keyed by text hash and simply overwritten.
 */
import 'dotenv/config';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { jobStatusSchema, statusKey, textKey, outputPrefix } from '../app/src/pollypress/common/jobStatus';
import { hashText, indexAudio } from '../app/src/pollypress/events/pollyEventProcessor/utils/audioIndex';

const APP_NAME = process.env.APP_NAME ?? 'PollyPress';
const STAGE = process.env.STAGE ?? process.env.NODE_ENV ?? 'staging';
const OUTPUT_BUCKET = `${APP_NAME.toLowerCase()}-${STAGE}-output`;
const AUDIO_INDEX_TABLE = `${APP_NAME}-${STAGE}-PollyPress-AudioIndex`;
// Matches the output bucket's 30-day expiry minus the index's 1-day margin
const MAX_AGE_MS = 29 * 24 * 60 * 60 * 1000;

const dryRun = process.argv.includes('--dry-run');
const s3 = new S3Client({});

const readObject = async (key: string): Promise<string | null> => {
    try {
        const { Body } = await s3.send(new GetObjectCommand({ Bucket: OUTPUT_BUCKET, Key: key }));
        return (await Body?.transformToString()) ?? null;
    } catch {
        return null;
    }
};

async function main() {
    console.log(`${dryRun ? '[dry run] ' : ''}Backfilling ${AUDIO_INDEX_TABLE} from s3://${OUTPUT_BUCKET}`);

    // Newest conversion wins if the same text was converted more than once
    const byHash = new Map<string, { fileId: string; audioKey: string; convertedAt: Date }>();
    let continuationToken: string | undefined;
    let skipped = 0;

    do {
        const page = await s3.send(new ListObjectsV2Command({
            Bucket: OUTPUT_BUCKET,
            Prefix: 'output/',
            ContinuationToken: continuationToken,
        }));
        continuationToken = page.NextContinuationToken;

        for (const object of page.Contents ?? []) {
            if (!object.Key?.endsWith('/audio.mp3') || !object.LastModified) continue;

            const fileId = object.Key.split('/')[1];
            const label = `${fileId} (${object.LastModified.toISOString()})`;

            if (Date.now() - object.LastModified.getTime() > MAX_AGE_MS) {
                console.log(`  skip ${label}: older than 29 days, about to be deleted`);
                skipped++;
                continue;
            }

            const rawStatus = await readObject(statusKey(fileId));
            const status = rawStatus ? jobStatusSchema.safeParse(JSON.parse(rawStatus)) : null;
            if (!status?.success || status.data.state !== 'completed' || status.data.reusedFrom) {
                console.log(`  skip ${label}: conversion not completed`);
                skipped++;
                continue;
            }

            const text = await readObject(textKey(fileId));
            if (!text) {
                console.log(`  skip ${label}: extracted text missing`);
                skipped++;
                continue;
            }

            const textHash = hashText(text);
            const existing = byHash.get(textHash);
            if (!existing || existing.convertedAt < object.LastModified) {
                byHash.set(textHash, { fileId, audioKey: object.Key, convertedAt: object.LastModified });
            }
            console.log(`  found ${label}: ${text.length.toLocaleString('en-US')} characters, hash ${textHash.slice(0, 12)}…`);
        }
    } while (continuationToken);

    for (const [textHash, entry] of byHash) {
        if (!dryRun) {
            await indexAudio({ tableName: AUDIO_INDEX_TABLE, textHash, ...entry });
        }
        console.log(`${dryRun ? '  would index' : '  indexed'} ${outputPrefix(entry.fileId)}`);
    }

    console.log(`Done: ${byHash.size} ${dryRun ? 'to index' : 'indexed'}, ${skipped} skipped.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
