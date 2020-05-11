const PostBody = ({ title, date, content, inContainer = false }) => `
<article class="${inContainer ? "" : "content"}">
  <header>
    <h3 style="margin-bottom: 0;">${title}</h3>
    <h6 style="margin-top: 0;" class="lt-text">${date.toDateString()}</h6>
  </header>

  <section>
    ${content}
  </section>
</article>
`;

module.exports = PostBody;
