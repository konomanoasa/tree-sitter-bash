import defineGrammar from "../common/grammar.js";

export default defineGrammar("bash_noextquote", {
  extglob: false,
  extquote: false,
});
