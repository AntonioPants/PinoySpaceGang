import { CesiumIonAuthPlugin } from '3d-tiles-renderer/three/plugins';

/** 0.4.18 can finish its endpoint request after TilesRenderer.dispose() has
 * removed the auth plugin, then fetch the root tileset without Authorization.
 * Stop that late continuation (including React StrictMode's trial mount).
 * The hook exists at runtime but is absent from the package's declarations. */
export class DisposableCesiumIonAuthPlugin extends CesiumIonAuthPlugin {
  private disposed = false;

  dispose() { this.disposed = true; }

  _initializeFromAsset(asset: unknown) {
    if (this.disposed) throw new DOMException('Tiles renderer disposed', 'AbortError');
    const prototype = CesiumIonAuthPlugin.prototype as unknown as {
      _initializeFromAsset(asset: unknown): void;
    };
    prototype._initializeFromAsset.call(this, asset);
  }
}
