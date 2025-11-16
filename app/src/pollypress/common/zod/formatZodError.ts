import type { ZodError, ZodIssue } from 'zod';

export const formatZodError = (error: ZodError): string => {
    return formatZodErrorIssues(error.issues);
};

export const formatZodErrorIssues = (issues: ZodIssue[]) => {
    return issues
        .map(({ message, path }) => {
            const pathString = path.join('.');
            return `${pathString && `'${pathString}': `}${message}`;
        })
        .join(';\n');
};
