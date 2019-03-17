// From <https://gist.github.com/jed/982883>
// Alternative: https://bl.ocks.org/solderjs/7e5ebb9a6708d0ebfc78

import {randomBytes} from '../compat.js'

export function uuid4 (
  a                  // placeholder
) {
  return a           // if the placeholder was passed, return
    ? (              // a random number from 0 to 15
      a ^            // unless b is 8,
      randomBytes(1) // in which case a random number from
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
        uuid4        // random hex digits
      )
}

