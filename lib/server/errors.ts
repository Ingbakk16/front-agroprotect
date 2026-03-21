import "server-only";

export class AgroServerError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export class AgroConfigError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 500, options);
  }
}

export class AgroGcsError extends AgroServerError {
  constructor(message: string, statusCode = 500, options?: ErrorOptions) {
    super(message, statusCode, options);
  }
}

export class AgroManifestError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 500, options);
  }
}

export class AgroExportResolutionError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 500, options);
  }
}

export class AgroDataError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 500, options);
  }
}

export class AgroNdjsonError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 500, options);
  }
}

export class AgroNotFoundError extends AgroServerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 404, options);
  }
}
