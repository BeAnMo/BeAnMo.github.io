const COLORS = (exports.COLORS = {
  // Primary
  WHITE: "#ffffff",
  DARK_BLUE: "#002f6d",
  LIGHT_BLUE: "#55c1e8",
  RED: "#ce112d",
  LIGHT_GRAY: "#97999b",
  // Secondary
  SEAFOAM: "#00A19c",
  MID_BLUE: "#0083c1",
  PURPLE: "#a97cc9",
  ORANGE: "#f98e2c",
});

const STYLE = `body {
  margin: 0;
  padding: 0;
  font-family: Merriweather, serif;
  background-color: #fbfbfb;
  color: #333333;
}

h1,h2,h3,h4,h5,h6 { font-family: Montserrat,  -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji; margin: 1rem 0; }
p { margin: 1rem 0;}

a { color: #0083C1; }
a:hover { color: #00A19C }
a:active { color:#F98E2C  }
a:visited { color: #CE112D }`;

const base = function ({ head = "", body = "" }) {
  return `<!DOCTYPE html>
  <html lang="en">
      <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />

          ${head}

          <link rel="stylesheet"
            href="https://fonts.googleapis.com/css?family=Montserrat" />
          <link rel="stylesheet"
            href="https://fonts.googleapis.com/css?family=Merriweather" />
          <link rel="stylesheet" 
            href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" />
      
          <style>
              ${this.cssmin(STYLE)}
          </style>

          <link rel="stylesheet" href="/assets/css/main.css" />
      </head>
      <body>
          ${body}

          <footer class="container" style="height: 4rem;">
              <div class="content" style="display: flex; justify-content: flex-end;">
                <h5>&copy; 2020 Benjamin Morin</h5>
              </div>
          </footer>
      </body>
  </html>`;
};

module.exports = base;
