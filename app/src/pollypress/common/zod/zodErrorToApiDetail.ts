import type { ZodError } from 'zod';

export const zodErrorToApiDetail = (error: ZodError): string => {
    const detail = error.issues
        .map(({ message, path }) => {
            const pathString = path.join('.');
            return `${pathString && `'${pathString}': `}${message}`;
        })
        .join(';\n');
    return detail;
};
