use pm_adapters_sqlite::SqliteStore;
use pm_domain::{
    Favorite, FavoriteTarget, ManagedService, ManagedServiceRun, RunOwnership, ServiceRunStatus,
};
use pm_ports::{FavoriteRepository, ManagedServiceRepository, RunStateRepository};

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
    assert_eq!(services[0].name(), "web");
}

#[tokio::test]
async fn sqlite_store_deletes_favorites_and_round_trips_run_state() {
    let store = SqliteStore::in_memory().expect("store");
    let service = ManagedService::command("api", "python app.py", None, vec![8000]);

    FavoriteRepository::upsert(&store, Favorite::new(FavoriteTarget::Port(8000)))
        .await
        .expect("favorite save");
    FavoriteRepository::delete(&store, &FavoriteTarget::Port(8000))
        .await
        .expect("favorite delete");

    let run = ManagedServiceRun {
        service_id: service.id(),
        status: ServiceRunStatus::Running,
        root_pid: Some(9001),
        child_pids: vec![9002],
        started_at: None,
        last_exit_code: None,
        log_path: Some("logs/api.log".into()),
        ownership: RunOwnership::Managed,
    };

    RunStateRepository::save(&store, run.clone())
        .await
        .expect("run save");

    let favorites = FavoriteRepository::list(&store)
        .await
        .expect("favorite list");
    let loaded_run = RunStateRepository::get(&store, service.id())
        .await
        .expect("run get");

    assert!(favorites.is_empty());
    assert_eq!(loaded_run, Some(run));
}
