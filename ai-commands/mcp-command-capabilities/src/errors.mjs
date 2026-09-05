export class CapabilityConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CapabilityConfigError';
    this.errorCode = 'INVALID_CAPABILITY_CONFIG';
  }
}

export class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolInputError';
    this.errorCode = 'INVALID_TOOL_ARGUMENTS';
  }
}

export class UnknownToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownToolError';
    this.errorCode = 'UNKNOWN_TOOL';
  }
}
