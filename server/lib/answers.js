'use strict';

const indices = value => Array.isArray(value) ? value : Number.isInteger(value) && value >= 0 ? [value] : [];
const answered = value => indices(value).length > 0;
const includes = (value, index) => indices(value).includes(index);
const matches = (answer, correct) => {
  const a = indices(answer), c = indices(correct);
  return a.length > 0 && a.length === c.length && new Set(a).size === a.length && a.every(i => c.includes(i));
};
const format = (value, options) => indices(value).map(i => `${'ABCDEF'[i]}. ${options[i] || ''}`).join('；');
function normalize(value, count, multiple) {
  if (multiple ? !Array.isArray(value) : !Number.isInteger(value)) return null;
  const list = indices(value);
  if (!list.length || new Set(list).size !== list.length || list.some(i => !Number.isInteger(i) || i < 0 || i >= count)) return null;
  return multiple ? list.slice().sort((a, b) => a - b) : value;
}
module.exports = { indices, answered, includes, matches, format, normalize };
