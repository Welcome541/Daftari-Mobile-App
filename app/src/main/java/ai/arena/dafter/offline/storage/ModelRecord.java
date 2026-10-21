package ai.arena.dafter.offline.storage;

/** Stable IDs and relative asset URLs only; no Android filesystem paths leave storage. */
public final class ModelRecord {

  public final String id, name, engine, assetUrl, state;
  public final long size;

  public ModelRecord(
    String id,
    String name,
    String engine,
    String assetUrl,
    long size,
    String state
  ) {
    this.id = id;
    this.name = name;
    this.engine = engine;
    this.assetUrl = assetUrl;
    this.size = size;
    this.state = state;
  }
}
