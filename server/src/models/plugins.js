/**
 * Serialización uniforme: `id` en lugar de `_id`, sin `__v`.
 * Se aplica a todos los schemas vía `baseOptions`.
 */
const transform = (_doc, ret) => {
  ret.id = ret._id?.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

export const baseOptions = {
  timestamps: true,
  toJSON: { virtuals: true, transform },
  toObject: { virtuals: true, transform },
};

/** Referencia al usuario que creó/modificó un registro. */
export const userRef = { type: 'ObjectId', ref: 'User' };
