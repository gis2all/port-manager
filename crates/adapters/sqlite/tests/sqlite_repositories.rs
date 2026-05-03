use pm_adapters_sqlite::SqliteStore;
use pm_domain::{Favorite, FavoriteTarget, ManagedService};
use pm_ports::{FavoriteRepository, ManagedServiceRepository};

#[tokio::test]
async fn sqlite_store_persists_favorites_and_services() {
    let store = SqliteStore::in_memory().expect("store");
    let service = ManagedService::command("web", "npm run dev", None, vec![3000]);
    let favorite = Favorite::new(FavoriteTarget::Port(3000));

    ManagedServiceRepository::save(&store, service.clone())
        .await
        .expect("service save");
    FavoriteRepository::upsert(&store, favorite)
        .await
        .expect("favorite save");

    let services = ManagedServiceRepository::list(&store)
        .await
        .expect("service list");
    let favorites = FavoriteRepository::list(&store)
        .await
        .expect("favorite list");

    assert_eq!(services.len(), 1);
    assert_eq!(favorites.len(), 1);
    assert_eq!(services[0].name, "web");
}
