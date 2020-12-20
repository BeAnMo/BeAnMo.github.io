
module.exports = function({ includeHomeLink = false }){
    return `
    <footer class="container" style="height: 4rem;">
        <div class="content" style="display: flex; justify-content: ${
            includeHomeLink ? "space-between" : "flex-end"
            }; align-items: baseline;">
            ${includeHomeLink ? '<a href="/">Back Home</a>' : ""}
        <h5>&copy; ${new Date().getFullYear()} Benjamin Morin</h5>
        </div>
    </footer>
    `;
}