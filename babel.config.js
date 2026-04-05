module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // Отключаем worklets/reanimated — не используем в этом проекте
          reanimated: false,
          worklets: false,
        },
      ],
      "nativewind/babel",
    ],
  };
};
