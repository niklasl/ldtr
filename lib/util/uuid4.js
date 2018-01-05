// From <https://gist.github.com/jed/982883>

var random;
if (typeof crypto !== 'undefined') {
  random = function () { return crypto.getRandomValues(new Uint8Array(1))[0] % 16 }
} else if (typeof require !== 'undefined') {
  var crypto = require('crypto');
  random = function () { return crypto.randomBytes(1)[0] % 16 }
} else {
  random = function () { return Math.random() * 16 }
}

function b(
  a                  // placeholder
) {
  return a           // if the placeholder was passed, return
    ? (              // a random number from 0 to 15
      a ^            // unless b is 8,
      random()       // in which case a random number from
      >> a/4         // 8 to 11
      ).toString(16) // in hexadecimal
    : (              // or otherwise a concatenated string:
      [1e7] +        // 10000000 +
      -1e3 +         // -1000 +
      -4e3 +         // -4000 +
      -8e3 +         // -8000 +
      -1e11          // -100000000000,
      ).replace(     // replacing
        /[018]/g,    // zeroes, ones, and eights with
        b            // random hex digits
      )
}

exports.uuid4 = b;

if (typeof require !== 'undefined' && require.main === module) {
  console.log(b())
}
