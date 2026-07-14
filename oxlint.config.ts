import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [oxlint.node],
    rules: {
        'import/exports-last': 'off',
        'import/no-namespace': 'off',
        'oxc/no-map-spread': 'off',
        'typescript/parameter-properties': 'off',
        'typescript/triple-slash-reference': 'off',
        'unicorn/prefer-global-this': 'off',
    },
});
