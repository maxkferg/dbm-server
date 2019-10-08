import tensorflow as tf
from ray.rllib.models import Model


class SimpleModel(Model):
    def _build_layers_v2(self, input_dict, num_outputs, options):
        """Define the layers of a custom model.

        Arguments:
            input_dict (dict): Dictionary of input tensors, including "obs",
                "prev_action", "prev_reward", "is_training".
            num_outputs (int): Output tensor must be of size
                [BATCH_SIZE, num_outputs].
            options (dict): Model options.

        Returns:
            (outputs, feature_layer): Tensors of size [BATCH_SIZE, num_outputs]
                and [BATCH_SIZE, desired_feature_size].

        When using dict or tuple observation spaces, you can access
        the nested sub-observation batches here as well:

        Examples:
            >>> print(input_dict)
            {'prev_actions': <tf.Tensor shape=(?,) dtype=int64>,
             'prev_rewards': <tf.Tensor shape=(?,) dtype=float32>,
             'is_training': <tf.Tensor shape=(), dtype=bool>,
             'obs': OrderedDict([
                ('sensors', OrderedDict([
                    ('front_cam', [
                        <tf.Tensor shape=(?, 10, 10, 3) dtype=float32>,
                        <tf.Tensor shape=(?, 10, 10, 3) dtype=float32>]),
                    ('position', <tf.Tensor shape=(?, 3) dtype=float32>),
                    ('velocity', <tf.Tensor shape=(?, 3) dtype=float32>)]))])}
        """
        obs = input_dict["obs"]
        ckpts = tf.keras.layers.Flatten(name="ckpts_flatten")(obs['ckpts'])

        # Concatenate all inputs together
        x = tf.keras.layers.Concatenate(axis=-1, name="mink_cat")([
            obs['target'],
            obs['robot_theta'],
            obs['robot_velocity'],
            ckpts
        ])

        #last_layer = tf.keras.layers.BatchNormalization()(x)
        #last_layer = x#tf.keras.layers.Dense(256, activation="relu", name="mink_last")(x)
        last_layer = x
        output_layer = tf.keras.layers.Dense(
            num_outputs, 
            activation=None, 
            name="simple_out"
        )(last_layer)

        return output_layer, last_layer


    def custom_stats(self):
        print("---------------------------------")
        stats = {
            "action_min": tf.reduce_min(self.output_actions),
            "action_max": tf.reduce_max(self.output_actions),
            "action_norm": tf.norm(self.output_actions),
            "critic_loss": tf.reduce_mean(self.critic_loss),
            "actor_loss": tf.reduce_mean(self.actor_loss),
            "td_error": tf.reduce_mean(self.td_error)
        }
        print("custom stats",stats)
        return stats

