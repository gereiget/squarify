import { createApp } from "./app.js";

const port = Number(process.env.BACKEND_PORT || 3000);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Squarify backend listening on 0.0.0.0:${port}`);
});
