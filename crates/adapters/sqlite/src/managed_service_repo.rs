use anyhow::Result;
use async_trait::async_trait;
use pm_domain::ManagedService;
use pm_ports::ManagedServiceRepository;

use crate::favorite_repo::SqliteStore;

#[async_trait]
impl ManagedServiceRepository for SqliteStore {
    async fn list(&self) -> Result<Vec<ManagedService>> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        let mut stmt = connection.prepare("select payload from managed_services order by id")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut services = Vec::new();
        for row in rows {
            services.push(serde_json::from_str(&row?)?);
        }

        Ok(services)
    }

    async fn get(&self, id: pm_domain::ManagedServiceId) -> Result<Option<ManagedService>> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        let payload = connection.query_row(
            "select payload from managed_services where id = ?1",
            [id.to_string()],
            |row| row.get::<_, String>(0),
        );

        match payload {
            Ok(json) => Ok(Some(serde_json::from_str(&json)?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    async fn save(&self, service: ManagedService) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute(
            "insert or replace into managed_services (id, payload) values (?1, ?2)",
            (service.id().to_string(), serde_json::to_string(&service)?),
        )?;
        Ok(())
    }

    async fn delete(&self, id: pm_domain::ManagedServiceId) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute(
            "delete from managed_services where id = ?1",
            [id.to_string()],
        )?;
        Ok(())
    }
}
