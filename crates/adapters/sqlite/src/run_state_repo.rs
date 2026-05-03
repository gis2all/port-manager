use anyhow::Result;
use async_trait::async_trait;
use pm_domain::{ManagedServiceId, ManagedServiceRun};
use pm_ports::RunStateRepository;

use crate::favorite_repo::SqliteStore;

#[async_trait]
impl RunStateRepository for SqliteStore {
    async fn get(&self, service_id: ManagedServiceId) -> Result<Option<ManagedServiceRun>> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        let payload = connection.query_row(
            "select payload from service_runs where service_id = ?1",
            [service_id.to_string()],
            |row| row.get::<_, String>(0),
        );

        match payload {
            Ok(json) => Ok(Some(serde_json::from_str(&json)?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    async fn save(&self, run: ManagedServiceRun) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute(
            "insert or replace into service_runs (service_id, payload) values (?1, ?2)",
            (run.service_id.to_string(), serde_json::to_string(&run)?),
        )?;
        Ok(())
    }
}
