const PostBody = ({ title, date, content, inContainer = false }) => `
<article class="${inContainer ? "" : "content"}">
  <header>
    <h1 style="margin-bottom: 0;">${title}</h1>
    <h5 style="margin-top: 0;" class="lt-text">${date.toDateString()}</h5>
  </header>

  <section>
    ${content}
  </section>
</article>
`;

module.exports = PostBody;
