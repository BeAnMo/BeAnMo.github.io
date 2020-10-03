const CleanCSS = require("clean-css");
const htmlmin = require("html-minifier");

module.exports = function (config) {
  config.setBrowserSyncConfig({
    browser: null,
    port: 4080,
  });

  config.addPassthroughCopy("assets");

  config.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  config.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath.endsWith(".html")) {
      return htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
    } else {
      return content;
    }
  });

  return {
    dir: {
      input: "src",
      output: "docs",
    },
  };
};
