/**
 * Validates the presence, type, and allowed values of fields in a given data object.
 *
 * @param {Object} data - The object to validate (e.g., req.body).
 * @param {Object} schema - Validation rules for each field.
 *   Each key in the schema is a field name and maps to an object with:
 *     - `required` (boolean): Whether the field must be present and non-empty.
 *     - `type` (string, optional): Expected JavaScript type (e.g., "string", "number", "boolean", "object").
 *     - `oneOf` (array, optional): List of allowed values for the field.
 *
 * @returns {Object} - A dictionary of validation errors.
 *   Keys are field names, values are error messages.
 *   Returns an empty object `{}` if all validations pass.
 *
 * @example
 * const errors = validateRequest(req.body, {
 *   username: { required: true, type: "string" },
 *   age: { required: false, type: "number" },
 *   status: { required: true, oneOf: ["active", "inactive"] }
 * });
 *
 * if (Object.keys(errors).length > 0) {
 *   return res.status(400).json({ errors });
 * }
 */

export function validateRequest(data, schema) {
    const errors = {};

    for (const field in schema) {
        const rules = schema[field];
        const value = data[field];

        if (
            rules.required &&
            (value === undefined || value === null || value === "")
        ) {
            errors[field] = `Missing required field: "${field}"`;
            continue;
        }
        if (value !== undefined && rules.type && typeof value !== rules.type) {
            errors[field] = `Invalid type. Expected ${
                rules.type
            }, got ${typeof value}`;
            continue;
        }

        if (
            value !== undefined &&
            rules.oneOf &&
            !rules.oneOf.includes(value)
        ) {
            errors[
                field
            ] = `Invalid value. Must be one of: ${rules.oneOf.join(
                ", "
            )}`;
            continue;
        }
    }

    return errors;
}
