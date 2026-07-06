use std::path::PathBuf;

fn wasm_path(name: &str) -> PathBuf {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let workspace_root = manifest_dir.join("../..");
    let target_dir = std::env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| workspace_root.join("target"));
    target_dir
        .join("wasm32v1-none/release")
        .join(name)
}

fn main() {
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    for name in ["sanca_factory.wasm", "sanca_pool.wasm"] {
        let src = wasm_path(name);
        println!("cargo:rerun-if-changed={}", src.display());
        std::fs::copy(&src, out_dir.join(name)).unwrap_or_else(|err| {
            panic!(
                "missing {name} at {} — run: cargo build --target wasm32v1-none --release -p sanca-factory -p sanca-pool ({err})",
                src.display()
            );
        });
    }
}
