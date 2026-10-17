import { describeAudioLength, nextDailyReset } from './dailyUsage';

describe('describeAudioLength', () => {
    it('describes the 2 hour daily limit', () => {
        expect(describeAudioLength(108_000)).toBe('about 2 hours');
    });

    it('combines hours and minutes', () => {
        expect(describeAudioLength(72_000)).toBe('about 1 hour 20 minutes');
    });

    it('describes short documents in minutes', () => {
        expect(describeAudioLength(31_500)).toBe('about 35 minutes');
    });

    it('never says zero minutes', () => {
        expect(describeAudioLength(28)).toBe('about 1 minute');
    });
});

describe('nextDailyReset', () => {
    it('returns the next UTC midnight', () => {
        expect(nextDailyReset(new Date('2026-10-17T13:45:00Z')).toISOString()).toBe('2026-10-18T00:00:00.000Z');
    });

    it('rolls over month ends', () => {
        expect(nextDailyReset(new Date('2026-10-31T23:59:59Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    });
});
