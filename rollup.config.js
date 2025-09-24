// rollup.config.js
import typescript from 'rollup-plugin-typescript2'; // Add TypeScript plugin
import babel from '@rollup/plugin-babel'; // Plugin for Babel
import resolve from '@rollup/plugin-node-resolve'; // Plugin to resolve node modules
import { minify } from 'terser';

export default {
  input: 'src/index.ts',  // Your entry point (index.ts)
  output: [
    {
      file: 'dist/relayx-api.cjs.js',  // CommonJS output for npm
      format: 'cjs',  // CommonJS format
      exports: 'auto',  // Default export for npm
    },
    {
      file: 'dist/relayx-api.esm.js',  // ES Module for modern bundlers
      format: 'esm',  // ES Module format
    },
    {
      file: 'dist/relayx-api.umd.js',  // UMD for browser usage via <script>
      format: 'umd',  // Universal Module Definition (UMD)
      name: 'MessageHandler',  // Global variable name when included via <script>
      exports:"auto",
      globals: {
        // Define global variables for any external dependencies if necessary
      },
    },
  ],
  plugins: [
    resolve(),  // Resolve modules from node_modules
    typescript({
      tsconfig: 'tsconfig.json', // Explicitly specify the path to tsconfig.json
      tsconfigDefaults: {
        compilerOptions: {
          declaration: true,
          declarationDir: 'dist/types',
          emitDeclarationOnly: false //Must be set to false
        }
      },
      clean: true // Clean up declaration files before each build
    }),
    babel({
      exclude: 'node_modules/**',  // Exclude node_modules from babel compilation
      babelHelpers: 'bundled',  // Ensure Babel helper code is bundled with the build
    }),
    // {
    //   name: 'terser',
    //   renderChunk: async (code) => {
    //     const result = await minify(code);
    //     return { code: result.code };
    //   }
    // }
  ],
  external: [],  // External dependencies (if any)
};
