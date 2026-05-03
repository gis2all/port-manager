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

    async fn save(&self, service: ManagedService) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute(
            "insert or replace into managed_services (id, payload) values (?1, ?2)",
            (service.id.to_string(), serde_json::to_string(&service)?),
        )?;
        Ok(())
    }
}
