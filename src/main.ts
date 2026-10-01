import "@fontsource-variable/gabarito/wght.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { app, applyCachedTheme } from "./lib/app.svelte";
import { initPwa } from "./lib/pwa.svelte";

applyCachedTheme();
const target = document.getElementById("app");
if (!target) throw new Error("Missing #app");
mount(App, { target });
void app.init();
initPwa();
