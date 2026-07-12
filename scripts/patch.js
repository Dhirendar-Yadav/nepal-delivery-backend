const fs = require("fs");

const file = "./backend/controllers/riderController.js";

let text = fs.readFileSync(file, "utf8");
const nl = text.includes("\r\n") ? "\r\n" : "\n";

function replaceOrFail(search, replace) {
  if (!text.includes(search)) {
    console.error("Pattern not found:");
    console.error(search);
    process.exit(1);
  }
  text = text.replace(search, replace);
}

const patch = process.argv[2];

switch (patch) {
  case "fix1":
    replaceOrFail(
      `session.startTransaction();${nl}${nl}    try {`,
      `session.startTransaction();${nl}${nl}    let riderId = null;${nl}    let riderLocked = null;${nl}${nl}    try {`
    );

    replaceOrFail(
      "const riderId = new mongoose.Types.ObjectId(req.user.id);",
      "riderId = new mongoose.Types.ObjectId(req.user.id);"
    );

    replaceOrFail(
      "const riderLocked = await User.findOneAndUpdate(",
      "riderLocked = await User.findOneAndUpdate("
    );
    break;

  default:
    console.error("Unknown patch");
    process.exit(1);
}

fs.writeFileSync(file, text);
console.log("Patch applied:", patch);
