import defineGrammar from "../common/grammar.js";

export default defineGrammar("bash_extglob_noextquote", {
  extglob: true,
  extquote: false,
});
