use anyhow::Result;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Db {
    pub connection: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(path: &str) -> Result<Self> {
        let connection = if path == ":memory:" {
            Connection::open_in_memory()?
        } else {
            Connection::open(path)?
        };

        connection.execute_batch(
            r#"
            create table if not exists favorites (
              target_key text primary key,
              payload text not null
            );
            create table if not exists managed_services (
              id text primary key,
              payload text not null
            );
            create table if not exists service_runs (
              service_id text primary key,
              payload text not null
            );
            "#,
        )?;

        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }
}
