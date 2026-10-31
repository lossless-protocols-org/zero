module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    // WatermelonDB models declare decorated, definitely-assigned fields
    // (`@text('x') x!: string`). From @react-native/babel-preset 0.88 the
    // preset's TypeScript pass sees those fields with an initializer and
    // refuses them unless class properties are lowered first — this is the
    // ordering WatermelonDB documents for React Native.
    ['@babel/plugin-transform-class-properties', {loose: true}],
    '@babel/plugin-transform-export-namespace-from',
    'react-native-worklets/plugin', // Must be listed last
  ],
};
