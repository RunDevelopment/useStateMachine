import { useEffect, useReducer, Dispatch } from 'react';
import useConstant from './useConstant';
import { __contextKey } from './constants';

type KeysOfTransition<Obj> = Obj extends Record<keyof Obj, string> ? keyof Obj : never;

type ContextUpdater<C> = (updater: (context: C) => C) => void;

type Transition<TName> =
  | TName
  | {
      target: TName;
      guard?: (context: any) => boolean;
    };

type States<T extends Record<keyof T, { on?: any }>> = {
  [K in keyof T]: {
    on?: Record<keyof NonNullable<T[K]['on']>, Transition<keyof T>>;
    effect?(
      send: (action: keyof NonNullable<T[K]['on']>) => void,
      context: any
    ): ((send: (action: keyof NonNullable<T[K]['on']>) => void, context: any) => void) | void;
  };
};

function stateNode<TEvents extends Record<keyof TEvents, PropertyKey | Record<'target', PropertyKey>>>(param: {
  on: TEvents;
  effect?:
    | ((
        send: (action: keyof TEvents) => void,
        context: any
      ) => ((send: (action: keyof TEvents) => void, context: any) => void) | void)
    | undefined;
}): typeof param;
function stateNode(param: { effect?: () => void; on?: undefined }): typeof param;
function stateNode<TEvents extends Record<keyof TEvents, PropertyKey | Record<'target', PropertyKey>>>({
  on,
  effect,
}: {
  on?: TEvents;
  effect?: (
    send: (action: keyof TEvents) => void,
    context: any
  ) => ((send: (action: keyof TEvents) => void, context: any) => void) | void;
}) {
  return { ...(on && { on }), ...(effect && { effect }) };
}

export default function useStateMachine<Context extends Record<PropertyKey, any>>(context?: Context) {
  return function useStateMachineWithContext<T extends States<T>>(config: { initial: keyof T; states: T }) {
    type Event = keyof T;

    const initialState = useConstant(() => ({
      value: config.initial,
      context: context ?? ({} as Context),
      nextEvents: Object.keys(config.states[config.initial].on ?? []) as Event[],
    }));

    const reducer = useConstant(
      () =>
        function reducer(
          state: {
            value: keyof T;
            context: Context;
            nextEvents: Event[];
          },
          event:
            | Event
            | {
                type: typeof __contextKey;
                updater: (context: Context) => Context;
              }
        ) {
          if (typeof event === 'object' && event.type === __contextKey) {
            return {
              ...state,
              context: event.updater(state.context),
            };
          }

          const currentState = config.states[state.value];
          // @ts-ignore
          const nextState: Transition<Event> = currentState?.on?.[event];

          // If there is no defined next state, return early
          if (!nextState) return state;

          // @ts-ignore
          const nextStateValue: keyof T = typeof nextState === 'string' ? nextState : nextState.target;

          // If there are guards, invoke them and return early if the transition is denied
          if (typeof nextState === 'object' && nextState.guard && !nextState.guard(state.context)) {
            return state;
          }

          return {
            ...state,
            value: nextStateValue as keyof T,
            nextEvents: Object.keys(config.states[nextStateValue].on ?? []) as Event[],
          };
        }
    );

    const [machine, send] = useReducer(reducer, initialState);

    // The updater function sends an internal event to the reducer to trigger the actual update
    const update = (updater: (context: Context) => Context) =>
      send({
        type: __contextKey,
        updater,
      });

    useEffect(() => {
      const exit = config.states[machine.value]?.effect?.(send as Dispatch<PropertyKey>, update);
      return typeof exit === 'function' ? exit.bind(null, send as Dispatch<PropertyKey>, update) : void 0;
    }, [machine.value]);

    return [machine, send] as [any, Dispatch<KeysOfTransition<NonNullable<T[keyof T]['on']>>>];
  };
}

/////////////////////////

const [machinestate, send] = useStateMachine()({
  initial: 'inactive',
  states: {
    inactive: stateNode({
      on: {
        ACTIVATE: 'active',
      },
    }),
    empty: stateNode({}),
    frozen: stateNode({
      effect() {
        console.log('Entered Frozen');
      },
    }),
    active: stateNode({
      on: {
        DEACTIVATE: 'inactive',
      },
      effect: send => {
        send('DEACTIVATE');
      },
    }),
  },
});

send('ACTIVATE');
