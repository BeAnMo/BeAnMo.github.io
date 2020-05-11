const ContentSection = ({ body, heading }) => `<section class="text-content">
    ${heading}
    <hr />
    ${body}
</section>`;

module.exports = ContentSection;
