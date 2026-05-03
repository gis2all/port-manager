use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ApplicationError {
    #[error("port {0} is not owned by a known process")]
    PortOwnerMissing(u16),
}
