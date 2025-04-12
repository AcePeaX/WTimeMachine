module.exports = {
    root: true,
    env: {
        browser: true,
        es2022: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module", // 👈 tells ESLint you're using ESM
    },
    extends: ["eslint:recommended"],
    rules: {
        // allow console by default
        "no-console": "error",
    },
    overrides: [
        {
            files: ["src/frontend/**/*.js"],
            rules: {
                "no-console": "off",
            },
        },
    ],
};
