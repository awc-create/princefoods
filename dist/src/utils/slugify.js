"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = slugify;
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}
