export type SeedReport = {
  readonly name: string;
  readonly target: string;
  /** Rows offered, not written: a repeat run keeps the ones already there. */
  readonly rows: number;
};

export type ExtendContext = {
  /** Derived for this seed, so a stream seeded from it is its own. */
  readonly seed: number;
  readonly now: Date;
};

export type IdContext = {
  readonly target: string;
  readonly key: string;
  readonly namespace: string;
};

export type BaseRunOptions<X extends object> = {
  /** Seeds every stream in the run. Same seed, same rows. */
  readonly seed?: number | undefined;
  readonly now?: Date | undefined;
  readonly namespace?: string | undefined;
  readonly onSeed?: ((report: SeedReport) => void) | undefined;
  /** Compute handles without writing. Sound because building never reads. */
  readonly dryRun?: boolean | undefined;
  /** Replaces uuid v5 as the id derivation. Must be pure. */
  readonly id?: ((context: IdContext) => string) | undefined;
  /** Built once per seed and spread into its toolkit. */
  readonly extend?: ((context: ExtendContext) => X) | undefined;
};

/** Optional until a seed needs extras, so a missing `extend` is noticed. */
export type RunArgs<X extends object> = object extends X
  ? [options?: BaseRunOptions<X>]
  : [
      options: BaseRunOptions<X> & {
        readonly extend: (context: ExtendContext) => X;
      },
    ];

export type RunOptions<X extends object = object> = NonNullable<RunArgs<X>[0]>;
