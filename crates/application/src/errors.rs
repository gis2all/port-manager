use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ApplicationError {
    #[error("port {0} is not owned by a known process")]
    PortOwnerMissing(u16),

    #[error("failed to control process: {0}")]
    ProcessControlFailed(String),

    #[error("managed service {0} not found")]
    ManagedServiceMissing(String),

    #[error("managed service {0} is missing a service name")]
    ManagedServiceMissingServiceName(String),

    #[error("managed service {0} is missing a start command")]
    ManagedServiceMissingStartCommand(String),

    #[error("managed service {0} is not currently running")]
    ManagedServiceNotRunning(String),

    #[error("invalid managed service kind: {0}")]
    InvalidManagedServiceKind(String),

    #[error("failed to control service: {0}")]
    ServiceControlFailed(String),

    #[error("failed to control command: {0}")]
    CommandControlFailed(String),
}
