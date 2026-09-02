function numericGetter(field) {
  return function get() {
    const value = this.getDataValue(field);
    if (value === null || value === undefined) {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
}

module.exports = { numericGetter };
