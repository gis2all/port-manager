use anyhow::Result;
use async_trait::async_trait;
use pm_ports::{DetectedServiceCandidate, ProjectDetector};
use regex::Regex;
use serde_json::Value;
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

pub struct ProjectFileDetector;

#[async_trait]
impl ProjectDetector for ProjectFileDetector {
    async fn detect(&self, root: &str) -> Result<Vec<DetectedServiceCandidate>> {
        let root = Path::new(root);
        let mut candidates = Vec::new();

        if let Some(candidate) = detect_package_json(root)? {
            candidates.push(candidate);
        }

        if let Some(candidate) = detect_docker_compose(root)? {
            candidates.push(candidate);
        }

        if let Some(candidate) = detect_pom_xml(root)? {
            candidates.push(candidate);
        }

        Ok(candidates)
    }
}

fn detect_package_json(root: &Path) -> Result<Option<DetectedServiceCandidate>> {
    let path = root.join("package.json");
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&path)?;
    let json: Value = serde_json::from_str(&text)?;
    let scripts = json.get("scripts").and_then(|value| value.as_object());
    let Some(scripts) = scripts else {
        return Ok(None);
    };

    let script_name = if scripts.contains_key("dev") {
        Some("dev")
    } else if scripts.contains_key("start") {
        Some("start")
    } else {
        None
    };

    let Some(script_name) = script_name else {
        return Ok(None);
    };

    let script_value = scripts
        .get(script_name)
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let ports = extract_ports(script_value);
    let project_name = json
        .get("name")
        .and_then(|value| value.as_str())
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| root.file_name().map(|name| name.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "project".into());

    let start_command = match script_name {
        "dev" => "npm run dev",
        "start" => "npm start",
        _ => "npm run dev",
    };

    Ok(Some(DetectedServiceCandidate {
        name: project_name,
        start_command: start_command.into(),
        workdir: root.to_string_lossy().into_owned(),
        expected_ports: ports,
        detected_from: "package.json".into(),
    }))
}

fn detect_docker_compose(root: &Path) -> Result<Option<DetectedServiceCandidate>> {
    let path = if root.join("docker-compose.yml").exists() {
        root.join("docker-compose.yml")
    } else if root.join("docker-compose.yaml").exists() {
        root.join("docker-compose.yaml")
    } else {
        return Ok(None);
    };

    let text = fs::read_to_string(&path)?;
    let ports = extract_ports(&text);
    if ports.is_empty() {
        return Ok(None);
    }

    Ok(Some(DetectedServiceCandidate {
        name: root
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "compose".into()),
        start_command: "docker compose up".into(),
        workdir: root.to_string_lossy().into_owned(),
        expected_ports: ports,
        detected_from: path.file_name().unwrap().to_string_lossy().into_owned(),
    }))
}

fn detect_pom_xml(root: &Path) -> Result<Option<DetectedServiceCandidate>> {
    let path = root.join("pom.xml");
    if !path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&path)?;
    let ports = extract_ports(&text);

    Ok(Some(DetectedServiceCandidate {
        name: root
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "java-app".into()),
        start_command: "mvn spring-boot:run".into(),
        workdir: root.to_string_lossy().into_owned(),
        expected_ports: ports,
        detected_from: "pom.xml".into(),
    }))
}

fn extract_ports(text: &str) -> Vec<u16> {
    let mut ports = BTreeSet::new();

    for port in extract_pattern(text, r"(?:--port|-p)\s+(\d{2,5})") {
        ports.insert(port);
    }

    for port in extract_pattern(text, r#"(?m)^\s*-\s*["']?(\d{2,5}):\d{2,5}["']?\s*$"#) {
        ports.insert(port);
    }

    for port in extract_pattern(text, r#"<server\.port>\s*(\d{2,5})\s*</server\.port>"#) {
        ports.insert(port);
    }

    ports.into_iter().collect()
}

fn extract_pattern(text: &str, pattern: &str) -> Vec<u16> {
    let regex = Regex::new(pattern).expect("valid regex");
    let mut ports = Vec::new();
    for captures in regex.captures_iter(text) {
        if let Some(port) = captures.get(1).and_then(|value| value.as_str().parse::<u16>().ok())
        {
            ports.push(port);
        }
    }
    ports
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[tokio::test]
    async fn detects_vite_project_from_package_json() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        fs::write(
            temp_dir.path().join("package.json"),
            r#"{ "name": "web", "scripts": { "dev": "vite --port 3000" } }"#,
        )
        .expect("package.json");

        let detector = ProjectFileDetector;
        let candidates = detector
            .detect(temp_dir.path().to_str().expect("path"))
            .await
            .expect("detect");

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].start_command, "npm run dev");
        assert_eq!(candidates[0].expected_ports, vec![3000]);
        assert_eq!(candidates[0].name, "web");
    }

    #[tokio::test]
    async fn detects_docker_compose_project() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        fs::write(
            temp_dir.path().join("docker-compose.yml"),
            "services:\n  web:\n    ports:\n      - \"8080:8080\"\n",
        )
        .expect("compose");

        let detector = ProjectFileDetector;
        let candidates = detector
            .detect(temp_dir.path().to_str().expect("path"))
            .await
            .expect("detect");

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].start_command, "docker compose up");
        assert_eq!(candidates[0].expected_ports, vec![8080]);
    }
}
