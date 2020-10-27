const base = require("./base-html");
const navbar = require("./navbar");
const PostBody = require("./post-body");

module.exports = function ({ title, content, date }) {
  return base.call(this, {
    title,
    body: `
      ${navbar({ brand: "Benjamin Morin", links: [] })}
      <main class="container">
        ${PostBody({ title, date, content })}
      </main>
      `,
    includeHomeLink: true,
  });
};
