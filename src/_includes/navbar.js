const navbar = ({ brand, links }) => `<nav class="navbar">
    <h3><a href="/#about-me">${brand}</a></h3>

    <div class="navbar-links">
        ${links.map(({ text, url }) => `<a href="${url}">${text}</a>`)}
    </div>
</nav>`;

module.exports = navbar;
