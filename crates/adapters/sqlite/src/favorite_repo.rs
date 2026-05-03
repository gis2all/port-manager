use crate::db::Db;
use anyhow::Result;
use async_trait::async_trait;
use pm_domain::{Favorite, FavoriteTarget};
use pm_ports::FavoriteRepository;
use std::path::Path;

#[derive(Clone)]
pub struct SqliteStore {
    pub(crate) db: Db,
}

impl SqliteStore {
    pub fn in_memory() -> Result<Self> {
        Ok(Self {
            db: Db::open(":memory:")?,
        })
    }

    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        Ok(Self { db: Db::open(path)? })
    }
}

#[async_trait]
impl FavoriteRepository for SqliteStore {
    async fn list(&self) -> Result<Vec<Favorite>> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        let mut stmt = connection.prepare("select payload from favorites order by target_key")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut favorites = Vec::new();
        for row in rows {
            favorites.push(serde_json::from_str(&row?)?);
        }

        Ok(favorites)
    }

    async fn upsert(&self, favorite: Favorite) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute(
            "insert or replace into favorites (target_key, payload) values (?1, ?2)",
            (favorite.target.key(), serde_json::to_string(&favorite)?),
        )?;
        Ok(())
    }

    async fn delete(&self, target: &FavoriteTarget) -> Result<()> {
        let connection = self.db.connection.lock().expect("sqlite connection");
        connection.execute("delete from favorites where target_key = ?1", [target.key()])?;
        Ok(())
    }
}
