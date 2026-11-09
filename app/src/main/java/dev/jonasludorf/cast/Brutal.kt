package dev.jonasludorf.cast

import android.content.Context
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.StateListDrawable

/** The website's look (web/src/styles/cast.css): 2 dp black border, hard 4 dp shadow, circles only for status. */
object Brutal {
    private fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).toInt()

    /** Square button face on its shadow; pressed, the face sits where the shadow was (res/animator/press.xml moves it). */
    fun button(context: Context, face: Int): Drawable {
        val shadow = dp(context, 4)
        val ink = context.getColor(R.color.ink)
        fun faceDrawable() = GradientDrawable().apply {
            setColor(face)
            setStroke(dp(context, 2), ink)
        }
        val rest = LayerDrawable(arrayOf(ColorDrawable(ink), faceDrawable())).apply {
            setLayerInset(0, shadow, shadow, 0, 0)
            setLayerInset(1, 0, 0, shadow, shadow)
        }
        val pressed = LayerDrawable(arrayOf(faceDrawable())).apply { setLayerInset(0, 0, 0, shadow, shadow) }
        return StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_pressed), pressed)
            addState(intArrayOf(), rest)
        }
    }

    /** Status circle: green ok, yellow waiting, red off or a problem. */
    fun dot(context: Context, color: Int): Drawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
        setStroke(dp(context, 2), context.getColor(R.color.ink))
    }
}
