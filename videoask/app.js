import { bootAdmin } from "./admin.js";
import { bootTake } from "./take.js";

const params = new URLSearchParams(location.search);
const takeId = params.get("take");

if (takeId) bootTake(takeId);
else bootAdmin();
