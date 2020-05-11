const base = require("./base-html");
const jumboTron = require("./jumbotron");
const PostBody = require("./post-body");

const Posts = ({ posts }) => `
${posts.map(
  ({ title, date, snippet, url }) => `
    <hr />
    ${PostBody({
      title: `<a href="${url}">${title}</a>`,
      date,
      content: snippet,
      inContainer: true,
    })}
`
)}`;

module.exports = function ({ content, title, subtitle, collections }) {
  return base.call(this, {
    body: `
      ${jumboTron({ title, subtitle })}
      <main class="container">
        <section class="content">
          ${content}
        </section>

        <section class="content">
          <header>
            <h3>Latest posts</h3>
          </header>

          ${Posts({
            posts: collections.post.map(
              ({ url, data: { title, date, snippet } }) => ({
                title,
                date,
                snippet,
                url,
              })
            ),
          })}
      </section>      
    </main>
  `,
  });
};
