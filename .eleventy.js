const CleanCSS = require("clean-css");
const htmlmin = require("html-minifier");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (config) {
  config.setBrowserSyncConfig({
    browser: null,
    port: 4080,
  });

  config.addPassthroughCopy("assets");

  config.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });

  // https://www.11ty.dev/docs/plugins/syntaxhighlight/
  config.addPlugin(syntaxHighlight);

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
