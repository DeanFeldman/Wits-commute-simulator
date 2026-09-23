import "./style.css";
import "./ui/creditsUI.js";
import { Game } from "./core/Game.js";

const container = document.querySelector("#game-container");

const game = new Game(container);
game.start();
