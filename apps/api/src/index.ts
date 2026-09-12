import { loadLocalEnv } from "./loadEnv.js";

loadLocalEnv();

import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(port, () => {
  console.log(`Veya API listening on http://localhost:${port}`);
});
